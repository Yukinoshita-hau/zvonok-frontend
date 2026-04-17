import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import AuthLayout from './layouts/Auth/AuthLayout'
import Login from './pages/Login/Login'
import Register from './pages/Register/Register'
import { RequireAuth } from './helpers/RequireAuth'
import { InboxLayout } from './pages/InboxLayout/InboxLayout'
import { DmChat } from './pages/DmChat/DmChat'
import { AppLayout } from './layouts/AppLayouts/AppLayout'
import { ChatPlaceholder } from './pages/ChatPlaceholder/ChatPlaceholder'
import { AuthInitializator } from './helpers/AppInitializer'
import { NotificationsPage } from './components/NotificationsPage/NotificationPage'
import { ServerLayout } from './pages/ServerLayout/ServerLayout'
import { ChannelChat } from './components/ChannelChat/ChannelChat'
import { MyServers } from './pages/MyServers/MyServers'

export function App() {

	const router = createBrowserRouter([
		{
			path: "/auth",
			element: <AuthLayout />,
			children: [
				{
					path: "login",
					element: <Login />
				},
				{
					path: "register",
					element: <Register />
				}
			]
		},
		{
			path: "/",
			element: (
				<RequireAuth>
					<AppLayout />
				</RequireAuth>
			),
			children: [
				{
					path: "/",
					element: (
						<InboxLayout />
					),
					children: [
						{
							index: true,
							element: (
								<ChatPlaceholder />
							),
						},
						{
							path: "dm",
							element: (
								<DmChat />
							)
						},
						{
							path: "notifications",
							element: <NotificationsPage />
						}
					]
				},
				{
					path: "server/:serverId",
					element: (
						<ServerLayout/>
					),
					children: [
						{
							index: true,
							element: <ChatPlaceholder/>
						},
						{
							path: "channel-folders/:channelFolderId/channels/:channelId",
							element: <ChannelChat/>
						}
					]
				},
				{
					path: "my-servers",
					element: (
						<MyServers/>	
					),
					children: []
				}
			]
		}
	])

	return (
		<AuthInitializator>
			<RouterProvider router={router} />
		</AuthInitializator>
	);
}
