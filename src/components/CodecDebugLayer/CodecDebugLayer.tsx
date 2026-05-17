import { useRoomContext, useTracks } from "@livekit/components-react";
import { LocalVideoTrack, RemoteVideoTrack, Track } from "livekit-client";
import { useEffect } from "react";


export function CodecDebugLayer() {
	const room = useRoomContext();

	const remoteVideoTracks = useTracks(
		[
			{ source: Track.Source.Camera, withPlaceholder: false },
			{ source: Track.Source.ScreenShare, withPlaceholder: false }
		],
		{ onlySubscribed: true }
	);

	useEffect(() => {
		const internalId = window.setInterval(async () => {
			const localCameraPub = room.localParticipant.getTrackPublication(
				Track.Source.Camera
			);

			const localScreenPub = room.localParticipant.getTrackPublication(
				Track.Source.ScreenShare
			);

			for (const publication of [localCameraPub, localScreenPub]) {
				const track = publication?.track;

				if (!(track instanceof LocalVideoTrack)) continue;

				const rows = await getOutboundVideoRows(track);

				console.group(
					`[LiveKit OUT] source=${publication?.source} sid=${publication?.trackSid}`
				);

				console.table(
					rows.map((row) => ({
						codec: row.codec,
						rid: row.rid ?? "-",
						resolution: `${row.width ?? "?"}x${row.height ?? "?"}`,
						fps: row.fps ?? "?",
						targetMbps: row.targetBitrate
							? (row.targetBitrate / 1_000_000).toFixed(2)
							: "?",
						sentMbps: row.bytesSent ? "see delta in devtools" : "?",
						qualityLimit: row.qualityLimitationReason ?? "none",
					}))
				);

				console.groupEnd()
			}

			for (const trackRef of remoteVideoTracks) {
				const track = trackRef.publication?.track;

				if (!(track instanceof RemoteVideoTrack)) continue;

				const stats = await track.getReceiverStats();

				console.group(
					`[LiveKit IN] from=${trackRef.participant.identity} source=${trackRef.source}`
				);

				console.table([
					{
						codec: stats?.mimeType ?? "?",
						resolution: `${stats?.frameWidth ?? "?"}x${stats?.frameHeight ?? "?"}`,
						framesDecoded: stats?.framesDecoded ?? "?",
						framesDropped: stats?.framesDropped ?? "?",
						bytesReceived: stats?.bytesReceived ?? "?",
						decoder: stats?.decoderImplementation ?? "?",
					},
				]);

				console.groupEnd();
			}
		}, 3000)

		return () => {
			window.clearInterval(internalId)
		};
	}, [room,remoteVideoTracks])

	return null;
}

type OutboundVideoRow = {
	codec?: string;
	rid?: string;
	width?: number;
	height?: number;
	fps?: number,
	targetBitrate?: number;
	bytesSent?: number;
	qualityLimitationReason?: string;
};

async function getOutboundVideoRows(
	track: LocalVideoTrack
): Promise<OutboundVideoRow[]> {
	const report = await track.getRTCStatsReport();

	if (!report) return [];

	const rows: OutboundVideoRow[] = [];

	report.forEach((stat) => {
		if (stat.type !== "outbound-rtp") return;
		if (stat.kind !== "video" && stat.mediaType !== "video") return;

		const codecStat = stat.codecId ? report.get(stat.codecId): undefined;

		rows.push({
			codec: codecStat?.mimeType,
			rid: stat.rid,
			width: stat.frameWidth,
			height: stat.frameHeight,
			fps: stat.framesPerSecond,
			targetBitrate: stat.targetBitrate,
			bytesSent: stat.byteSent,
			qualityLimitationReason: stat.qualityLimitationReason,
		});
	});

	return rows;
}

