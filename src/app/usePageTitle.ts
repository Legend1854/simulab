import { useEffect } from 'react';

/** Sets the document title and, after in-app navigation, moves focus to the page heading for screen-reader users. */
export function usePageTitle(title: string, focusHeading = true): void {
  useEffect(() => {
    document.title = `${title} | SimuLab`;
    if (!focusHeading) return;
    const heading = document.getElementById('page-title');
    if (heading && document.activeElement !== heading && document.body.dataset.navigated === 'true') heading.focus({ preventScroll: false });
  }, [title, focusHeading]);
}
