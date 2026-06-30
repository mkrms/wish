// Windows でリリースビルド時にコンソールウィンドウを出さない。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    wish_lib::run()
}
