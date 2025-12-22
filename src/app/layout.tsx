export const metadata = {
    title: 'Invoice App',
    description: 'Form to generate invoice',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body style={{ margin: 0 }}>{children}</body>
        </html>
    );
}



