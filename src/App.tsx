import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import AuthLayout from './layouts/Auth/AuthLayout'
import Login from './pages/Login/Login'
import Register from './pages/Register/Register'
import { RequireAuth } from './helpers/RequireAuth'
import { AuthInitializator } from './helpers/AuthInitializer'
import { InboxLayout } from './pages/InboxLayout/InboxLayout'
import { ChatPlaceholder } from './pages/ChatPlaceholder/ChatPlaceholder'
import { DmChat } from './pages/DmChat/DmChat'
import { AppLayout } from './layouts/AppLayouts/AppLayout'

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
						// для показа пустышки окна чата
						{
							index: true,
							element: (
								<ChatPlaceholder />
							),
						},
						{
							path: ":roomId",
							element: (
								<DmChat />
							)
						}
					]
				},
				{
					path: "servers/:serverId",
					element: (
						<></>
					),
					children: [
						{
							index: true,
							element: (
								<></>
							)
						},
						{
							path: "channels/:channelId",
							element: (
								<></>
							)
						}
					]
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
