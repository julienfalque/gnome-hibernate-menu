all: dist/extension.js

node_modules: package.json package-lock.json
	docker compose run node npm install

dist/extension.js: node_modules extension.ts
	docker compose run node npx tsc

nested-gnome:
	MUTTER_DEBUG_DUMMY_MODE_SPECS=1366x768 dbus-run-session -- gnome-shell --nested --wayland

.PHONY: hibernate-menu@julienfalque.shell-extension.zip
hibernate-menu@julienfalque.shell-extension.zip: dist/extension.js
	@cp --recursive metadata.json po dist/
	@gnome-extensions pack --force dist

pack: hibernate-menu@julienfalque.shell-extension.zip

install: hibernate-menu@julienfalque.shell-extension.zip
	@touch ~/.local/share/gnome-shell/extensions/hibernate-menu@julienfalque
	@rm -rf ~/.local/share/gnome-shell/extensions/hibernate-menu@julienfalque
	@mv dist ~/.local/share/gnome-shell/extensions/hibernate-menu@julienfalque

clean:
	@rm -rf dist node_modules hibernate-menu@julienfalque.shell-extension.zip
