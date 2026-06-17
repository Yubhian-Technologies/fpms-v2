export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background/80 backdrop-blur-sm">
      <div className="container py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <p className="text-muted-foreground">
            © {currentYear} Sri Vishnu Educational Society. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Developed by</span>
            <span className="text-sm">Yubhian Technologies LLP</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
