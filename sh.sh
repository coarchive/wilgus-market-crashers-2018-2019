#! bin/bash

npm_dir() {
  cd "$1" && shift && npm "$@"
}
frontend() {
  npm_dir frontend "$@"
}
backend() {
  npm_dir backend "$@"
}
mkdir -p dist/public
rm -f dist/.copied
case $1 in
  start)
    frontend start & backend start
    exit 0
  ;;
  build)
    frontend run build & backend run build
    exit 0
  ;;
  init)
    frontend i & backend i
    exit 0
  ;;
esac
