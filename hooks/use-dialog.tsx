import React, { createContext, useCallback, useContext, useState } from 'react';

import { CustomDialog } from '../components/custom-dialog';
import type { DialogButton } from '../components/custom-dialog';
import type { KeyboardTypeOptions } from 'react-native';

type DialogOptions = {
  inputMode?: boolean;
  inputPlaceholder?: string;
  inputDefaultValue?: string;
  inputKeyboardType?: KeyboardTypeOptions;
};

type DialogState = {
  visible: boolean;
  title: string;
  message?: string;
  buttons: DialogButton[];
  options: DialogOptions;
};

type DialogContextType = {
  showDialog: (
    title: string,
    message?: string,
    buttons?: DialogButton[],
    options?: DialogOptions,
  ) => void;
  _state: DialogState;
  _handleClose: () => void;
};

const DialogContext = createContext<DialogContextType>({
  showDialog: () => {},
  _state: { visible: false, title: '', buttons: [], options: {} },
  _handleClose: () => {},
});

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState>({
    visible: false,
    title: '',
    message: undefined,
    buttons: [],
    options: {},
  });

  const showDialog = useCallback(
    (
      title: string,
      message?: string,
      buttons?: DialogButton[],
      options?: DialogOptions,
    ) => {
      setState({
        visible: true,
        title,
        message,
        buttons: buttons || [{ text: 'OK' }],
        options: options || {},
      });
    },
    [],
  );

  const handleClose = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  return (
    <DialogContext.Provider value={{ showDialog, _state: state, _handleClose: handleClose }}>
      {children}
      <DialogOverlay />
    </DialogContext.Provider>
  );
}

export function DialogOverlay() {
  const { _state: state, _handleClose: handleClose } = useContext(DialogContext);

  return (
    <CustomDialog
      visible={state.visible}
      title={state.title}
      message={state.message}
      buttons={state.buttons}
      onClose={handleClose}
      inputMode={state.options.inputMode}
      inputPlaceholder={state.options.inputPlaceholder}
      inputDefaultValue={state.options.inputDefaultValue}
      inputKeyboardType={state.options.inputKeyboardType}
    />
  );
}

export function useDialog() {
  const { showDialog } = useContext(DialogContext);
  return { showDialog };
}
