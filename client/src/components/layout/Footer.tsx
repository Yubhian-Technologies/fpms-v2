import yubhianLogo from "../../assets/image.png";
export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background/80 backdrop-blur-sm">
      <div className="container py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          {/* Copyright Section - Left */}
          <p className="text-muted-foreground">
            © {currentYear} Vishnu Educational Society. All rights
            reserved.
          </p>

          {/* Developer Section - Right */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Developed by</span>
             <div className="flex items-center justify-center w-4 h-4 rounded-sm bg-gradient-to-br from-primary to-primary/60 text-white text-xs font-bold">
                <img src={yubhianLogo} alt="Yubhian Logo" />
              </div>
            {/* Yubhian Logo */}
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded ">
             
              <span className="text-sm">
                Yubhian Technologies LLP
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
