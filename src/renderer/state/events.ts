type StatusListener = (message: string) => void;

const listeners = new Set<StatusListener>();
let lastMessage = '';

export const setStatus = (message: string) => {
  lastMessage = message;
  listeners.forEach((listener) => listener(message));
};

export const onStatus = (listener: StatusListener) => {
  listeners.add(listener);
  if (lastMessage) listener(lastMessage);
  return () => listeners.delete(listener);
};

export const getLastStatus = () => lastMessage;
