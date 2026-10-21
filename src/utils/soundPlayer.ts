let callAudio: HTMLAudioElement | undefined;
let messageAudio: HTMLAudioElement | undefined;

export const soundPlayer = {
	async test(kind: 'message' | 'call') {
		const audio = new Audio(`${import.meta.env.BASE_URL}sounds/${kind === 'call' ? 'incoming-call' : 'message'}.mp3`);
		const cleanup = () => { audio.pause(); audio.removeAttribute('src'); audio.load(); };
		const timer = setTimeout(cleanup, 2500);
		audio.onended = () => { clearTimeout(timer); cleanup(); };
		try { await audio.play(); } catch (error) { clearTimeout(timer); cleanup(); throw error; }
	},
	startCallRingtone() {
		callAudio ??= new Audio(`${import.meta.env.BASE_URL}sounds/incoming-call.mp3`);
		callAudio.loop = true;
		callAudio.currentTime = 0;
		void callAudio.play().catch(error => console.warn('Воспроизведение звонка заблокировано', error));
	},
	stopCallRingtone() {
		callAudio?.pause();
	},
	playMessage() {
		messageAudio ??= new Audio(`${import.meta.env.BASE_URL}sounds/message.mp3`);
		messageAudio.currentTime = 0;
		void messageAudio.play().catch(error => console.warn('Воспроизведение уведомления заблокировано', error));
	}
}
