import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import { PopupMenuItem } from 'resource:///org/gnome/shell/ui/popupMenu.js';

// https://www.freedesktop.org/software/systemd/man/latest/org.freedesktop.login1.html
const dbusInterface = `
  <node>
    <interface name="org.freedesktop.login1.Manager">
      <method name="Hibernate">
        <arg type="b" direction="in"/>
      </method>
      <method name="CanHibernate">
        <arg type="s" direction="out"/>
      </method>
    </interface>
  </node>
`;

const suspendItemIndex = 0;

type DBusProxyCallback<T extends Array<any>> = (returnValue: T, error: Error|null) => void;

type HibernateDBusProxy = {
  HibernateRemote: (interactive: boolean, callback: DBusProxyCallback<[]>) => void;
  CanHibernateRemote: (callback: DBusProxyCallback<['na'|'no'|'yes'|'challenge']>) => void;
}

export default class HibernateMenuExtension extends Extension {
  private hibernateItem: PopupMenuItem|null = null;
  private dBusProxy: HibernateDBusProxy|null = null;
  private sessionId: number|null = null;

  enable(): void {
    const label = _('Hibernate');

    this.hibernateItem = new PopupMenuItem(label);
    this.hibernateItem.visible = false;
    this.hibernateItem.connect('activate', async () => {
      Main.panel.closeQuickSettings();

      await this.hibernate();
    });

    const powerButton = Main.panel.statusArea.quickSettings._system._systemItem.child.get_children().find(e => e.icon_name === "system-shutdown-symbolic");
    powerButton.menu.addMenuItem(this.hibernateItem, suspendItemIndex + 1);

    powerButton._systemActions._actions.set('hibernate', {
      name: label,
      iconName: 'media-playback-pause-symbolic',
      keywords: ['hibernate', _('hibernate')],
      available: true,
    });

    const DBusProxy = Gio.DBusProxy.makeProxyWrapper<HibernateDBusProxy>(dbusInterface);
    this.dBusProxy = DBusProxy(
      Gio.DBus.system,
      'org.freedesktop.login1',
      '/org/freedesktop/login1'
    );

    this.updateItemVisibility();
    this.sessionId = Main.sessionMode.connect('update', () => {
      this.updateItemVisibility();
    });
  }

  disable(): void {
    if (this.sessionId !== null) {
      Main.sessionMode.disconnect(this.sessionId);
      this.sessionId = null;
    }

    this.dBusProxy = null;

    this.hibernateItem?.destroy();
    this.hibernateItem = null;
  }

  updateItemVisibility(): void {
    this.userCanHibernate().then((userCanHibernate) => {
      if (this.hibernateItem !== null) {
        this.hibernateItem.visible = userCanHibernate;
      }
    })
  }

  async hibernate(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.dBusProxy === null) {
        reject();

        return;
      }

      this.dBusProxy.HibernateRemote(true, (result, error) => {
        if (error === null) {
          resolve();

          return;
        }

        reject(error);
      });
    });
  }

  async userCanHibernate(): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      if (this.dBusProxy === null) {
        reject();

        return;
      }

      this.dBusProxy.CanHibernateRemote(([ result ], error) => {
        if (error === null) {
          resolve(result === "yes" || result === "challenge");

          return;
        }

        reject(error);
      });
    });
  }
}
