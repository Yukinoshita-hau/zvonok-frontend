const callAudio = new Audio(`${import.meta.env.BASE_URL}sounds/incoming-call.mp3`);
callAudio.loop = true;

const messageAudio = new Audio(`${import.meta.env.BASE_URL}sounds/message.mp3`);

export const soundPlayer = {
	startCallRingtone() {
		callAudio.currentTime = 0;
		void callAudio.play();
	},
	stopCallRingtone() {
		callAudio.pause();
	},
	playMessage() {
		messageAudio.currentTime = 0;
		void messageAudio.play();
	}
}
