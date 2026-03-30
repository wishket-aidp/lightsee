use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    http::StatusCode,
    response::{Html, IntoResponse, Json},
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::{
    atomic::{AtomicU32, Ordering},
    Arc,
};
use tokio::sync::{broadcast, Mutex, RwLock, watch};

// --- Public types (used by Tauri commands) ---

#[derive(Clone, Serialize, Deserialize)]
pub struct ThemeColors {
    pub bg: String,
    pub text: String,
    pub heading: String,
    pub link: String,
    #[serde(rename = "codeBg")]
    pub code_bg: String,
    pub border: String,
    #[serde(rename = "blockquoteBorder")]
    pub blockquote_border: String,
    #[serde(rename = "blockquoteText")]
    pub blockquote_text: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ContentPayload {
    pub html: String,
    pub theme: ThemeColors,
    #[serde(rename = "fontSize")]
    pub font_size: u16,
    #[serde(rename = "fileName")]
    pub file_name: String,
}

#[derive(Serialize)]
pub struct ShareInfo {
    pub url: String,
    #[serde(rename = "qrSvg")]
    pub qr_svg: String,
    pub port: u16,
    pub token: String,
}

#[derive(Serialize)]
pub struct ShareStatus {
    pub running: bool,
    pub url: Option<String>,
    #[serde(rename = "connectedClients")]
    pub connected_clients: u32,
    #[serde(rename = "qrSvg")]
    pub qr_svg: Option<String>,
    pub token: Option<String>,
}

// --- Internal shared state for axum server ---

struct AppState {
    content: RwLock<ContentPayload>,
    notify: broadcast::Sender<()>,
    token: String,
    client_count: AtomicU32,
}

struct ActiveShare {
    state: Arc<AppState>,
    shutdown_tx: watch::Sender<bool>,
    url: String,
    token: String,
    qr_svg: String,
}

// --- ShareManager (managed by Tauri) ---

pub struct ShareManager {
    active: Mutex<Option<ActiveShare>>,
}

impl ShareManager {
    pub fn new() -> Self {
        Self {
            active: Mutex::new(None),
        }
    }

    pub async fn start(&self, content: ContentPayload, port: u16) -> Result<ShareInfo, String> {
        let mut guard = self.active.lock().await;
        if guard.is_some() {
            return Err("Already sharing".into());
        }

        let token = generate_token();
        let (notify_tx, _) = broadcast::channel(64);
        let (shutdown_tx, shutdown_rx) = watch::channel(false);

        let state = Arc::new(AppState {
            content: RwLock::new(content),
            notify: notify_tx,
            token: token.clone(),
            client_count: AtomicU32::new(0),
        });

        let app = Router::new()
            .route("/", get(serve_viewer))
            .route("/api/content", get(get_content))
            .route("/api/health", get(health))
            .route("/ws", get(ws_upgrade))
            .with_state(state.clone());

        let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port))
            .await
            .map_err(|e| format!("Failed to bind port {}: {}", port, e))?;

        let actual_port = listener.local_addr().unwrap().port();

        let mut rx = shutdown_rx;
        tokio::spawn(async move {
            axum::serve(listener, app)
                .with_graceful_shutdown(async move {
                    let _ = rx.changed().await;
                })
                .await
                .ok();
        });

        let local_ip = local_ip_address::local_ip()
            .map(|ip| ip.to_string())
            .unwrap_or_else(|_| "127.0.0.1".into());

        let url = format!("http://{}:{}/?token={}", local_ip, actual_port, token);
        let qr_svg = generate_qr_svg(&url);

        let info = ShareInfo {
            url: url.clone(),
            qr_svg: qr_svg.clone(),
            port: actual_port,
            token: token.clone(),
        };

        *guard = Some(ActiveShare {
            state,
            shutdown_tx,
            url,
            token,
            qr_svg,
        });

        Ok(info)
    }

    pub async fn stop(&self) -> Result<(), String> {
        let mut guard = self.active.lock().await;
        if let Some(active) = guard.take() {
            active.shutdown_tx.send(true).ok();
            Ok(())
        } else {
            Err("Not sharing".into())
        }
    }

    pub async fn update_content(&self, content: ContentPayload) -> Result<(), String> {
        let state = {
            let guard = self.active.lock().await;
            match guard.as_ref() {
                Some(active) => active.state.clone(),
                None => return Err("Not sharing".into()),
            }
        };

        *state.content.write().await = content;
        state.notify.send(()).ok();
        Ok(())
    }

    pub async fn status(&self) -> ShareStatus {
        let guard = self.active.lock().await;
        match guard.as_ref() {
            Some(active) => ShareStatus {
                running: true,
                url: Some(active.url.clone()),
                connected_clients: active.state.client_count.load(Ordering::Relaxed),
                qr_svg: Some(active.qr_svg.clone()),
                token: Some(active.token.clone()),
            },
            None => ShareStatus {
                running: false,
                url: None,
                connected_clients: 0,
                qr_svg: None,
                token: None,
            },
        }
    }
}

// --- Token generation ---

fn generate_token() -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    use std::time::{SystemTime, UNIX_EPOCH};

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let mut hasher = DefaultHasher::new();
    now.as_nanos().hash(&mut hasher);
    std::process::id().hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

// --- QR code generation ---

fn generate_qr_svg(data: &str) -> String {
    match qrcode::QrCode::new(data) {
        Ok(code) => code
            .render()
            .min_dimensions(200, 200)
            .dark_color(qrcode::render::svg::Color("#000000"))
            .light_color(qrcode::render::svg::Color("#ffffff"))
            .build(),
        Err(_) => String::new(),
    }
}

// --- Auth helper ---

#[derive(Deserialize)]
struct TokenQuery {
    token: Option<String>,
}

fn check_token(state: &AppState, query: &TokenQuery) -> bool {
    query.token.as_deref() == Some(&state.token)
}

// --- Axum handlers ---

async fn serve_viewer(
    State(state): State<Arc<AppState>>,
    Query(query): Query<TokenQuery>,
) -> impl IntoResponse {
    if !check_token(&state, &query) {
        return (StatusCode::UNAUTHORIZED, Html("Unauthorized".into()));
    }
    let viewer = include_str!("viewer.html").replace("{{TOKEN}}", &state.token);
    (StatusCode::OK, Html(viewer))
}

async fn get_content(
    State(state): State<Arc<AppState>>,
    Query(query): Query<TokenQuery>,
) -> impl IntoResponse {
    if !check_token(&state, &query) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "Unauthorized"})),
        )
            .into_response();
    }
    let content = state.content.read().await;
    Json(serde_json::json!({
        "html": content.html,
        "theme": content.theme,
        "fontSize": content.font_size,
        "fileName": content.file_name,
    }))
    .into_response()
}

async fn health() -> impl IntoResponse {
    Json(serde_json::json!({"status": "ok"}))
}

async fn ws_upgrade(
    State(state): State<Arc<AppState>>,
    Query(query): Query<TokenQuery>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    if !check_token(&state, &query) {
        return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response();
    }
    ws.on_upgrade(move |socket| handle_ws(socket, state))
        .into_response()
}

async fn handle_ws(mut socket: WebSocket, state: Arc<AppState>) {
    state.client_count.fetch_add(1, Ordering::Relaxed);
    let mut rx = state.notify.subscribe();

    loop {
        tokio::select! {
            result = rx.recv() => {
                match result {
                    Ok(()) => {
                        if socket.send(Message::Text("update".to_string())).await.is_err() {
                            break;
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(broadcast::error::RecvError::Closed) => break,
                }
            }
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Ping(data))) => {
                        if socket.send(Message::Pong(data)).await.is_err() {
                            break;
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }
        }
    }

    state.client_count.fetch_sub(1, Ordering::Relaxed);
}
