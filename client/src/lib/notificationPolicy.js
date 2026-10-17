/**
 * Notification policy: every user-facing toast in the app flows through here.
 * Why: consistent durations per severity, one place to mute/queue/redirect
 * notifications later (e.g. silent mode during focus). API mirrors
 * react-hot-toast so migration is mechanical.
 */
import { toast } from 'react-hot-toast';

const DURATIONS = {
    success: 4000,
    error: 5000, // errors stay readable - they usually need action
    info: 4000,
    loading: Infinity,
};

// Focus Mode mutes PrioSync chatter while a session runs. Errors always
// break through (they need action); success/info wait until unmuted.
let muted = false;
export const setMuted = (value) => {
    muted = !!value;
};
export const isMuted = () => muted;

const notify = (message, opts = {}) => {
    if (muted) return null;
    return toast(String(message), { duration: DURATIONS.info, ...opts });
};

notify.success = (message, opts = {}) => {
    if (muted) return null;
    return toast.success(String(message), { duration: DURATIONS.success, ...opts });
};

notify.error = (message, opts = {}) => toast.error(String(message), { duration: DURATIONS.error, ...opts });

notify.loading = (message, opts = {}) => toast.loading(String(message), { duration: DURATIONS.loading, ...opts });

notify.dismiss = (id) => toast.dismiss(id);

notify.promise = (promise, msgs, opts = {}) => toast.promise(promise, msgs, opts);

export const NOTIFY_DURATIONS = DURATIONS;

export default notify;
