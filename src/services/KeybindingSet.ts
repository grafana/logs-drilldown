import { Mousetrap } from './Mousetrap';

export const mousetrap = new Mousetrap(document);

export interface KeyBindingItem {
  /** Key or key pattern like mod+o */
  key: string;
  /** The handler callback */
  onTrigger: () => void;
  /** Defaults to keydown */
  type?: string;
}

/**
 * Small util to make it easier to add and unbind Mousetrap keybindings
 */
export class KeybindingSet {
  private _binds: KeyBindingItem[] = [];

  addBinding(item: KeyBindingItem) {
    mousetrap.bind(
      item.key,
      (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        evt.returnValue = false;
        item.onTrigger();
      },
      'keydown'
    );
    this._binds.push(item);
  }

  removeAll() {
    this._binds.forEach((item) => {
      mousetrap.unbind(item.key, item.type);
    });
    this._binds = [];
  }
}
