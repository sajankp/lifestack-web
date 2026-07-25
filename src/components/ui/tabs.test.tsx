import { render, screen } from '@testing-library/react';

import { Tabs, TabsList, TabsTrigger } from './tabs';

describe('TabsList', () => {
  it('scrolls horizontally instead of forcing page-level overflow (web#201)', () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Currency & Display</TabsTrigger>
          <TabsTrigger value="b">Accounts</TabsTrigger>
          <TabsTrigger value="c">Categories & Groups</TabsTrigger>
          <TabsTrigger value="d">Weekly Summaries</TabsTrigger>
          <TabsTrigger value="e">Danger zone</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    expect(screen.getByRole('tablist')).toHaveClass('max-w-full', 'overflow-x-auto');
  });
});
