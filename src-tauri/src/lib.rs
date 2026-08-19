#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // HTTP 요청을 웹뷰가 아니라 Rust 로 내보내 브라우저 CORS 를 우회한다.
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_process::init());

    // 자동 업데이트는 데스크톱에서만 등록한다.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
