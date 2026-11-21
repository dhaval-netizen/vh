# Clean URL browser checks

Run these checks against a static preview after `npm run build` and `npm test`.

- Open the site root, click The idea, then Our approach. Both addresses must be clean, and the second link must resolve from the site root rather than `/idea/`.
- Click the home wordmark from a section. It must return to the root address and page top.
- Navigate between sections, then use Back and Forward. Each address must match the section shown.
- Open `/philosophy/owning-it/` directly and refresh. The ownership heading must appear near the top, with styles and fonts loaded.
- From the nested article section, click Back to top, then Under the hood. The article links must retain the site root even though the path depth changes.
- Open `/philosophy.html#owning-it`. It must become `/philosophy/owning-it/` while keeping the ownership destination.
- Repeat with a GitHub project prefix such as `/vh/`. Internal links and assets must keep that prefix.
- At 700 pixels wide, Questions stays hidden in the header. At 390 pixels wide, Menu opens the navigation and a section link closes it.
- Activate Skip to content with the keyboard. Focus must move to main content without changing the address.
- Command-click a section link. It must open a separate tab without changing the original tab's address.

Chrome verification on 2026-10-19 covered all ten checks. A review caught the changing document base after history navigation; the original failing second-link result was `/vh/idea/approach/`. Freezing the document base corrected it to `/vh/approach/`.

- At the bottom of the home page, click every footer link at 1440px, 820px and 390px wide. Section links scroll to their section; other links open their page. (The oversized footer wordmark once covered these links.)
