import { decideNavigation } from './navigation-policy';

const ALLOWED_ORIGIN = 'https://app.example.com';

describe('decideNavigation', () => {
  it('같은 origin 경로는 allow한다', () => {
    expect(decideNavigation('https://app.example.com/scan/result', ALLOWED_ORIGIN)).toBe('allow');
  });

  it('같은 origin이면 쿼리·해시가 있어도 allow한다', () => {
    expect(decideNavigation('https://app.example.com/login?next=/home#top', ALLOWED_ORIGIN)).toBe('allow');
  });

  it('about:blank은 allow한다', () => {
    expect(decideNavigation('about:blank', ALLOWED_ORIGIN)).toBe('allow');
  });

  it('다른 https(s) origin은 external로 시스템 브라우저에 위임한다', () => {
    expect(decideNavigation('https://other.com', ALLOWED_ORIGIN)).toBe('external');
  });

  it('http 다른 origin도 external이다', () => {
    expect(decideNavigation('http://other.com', ALLOWED_ORIGIN)).toBe('external');
  });

  it('javascript: 스킴은 block한다', () => {
    expect(decideNavigation('javascript:alert(1)', ALLOWED_ORIGIN)).toBe('block');
  });

  it('file:// 스킴은 block한다', () => {
    expect(decideNavigation('file:///etc/passwd', ALLOWED_ORIGIN)).toBe('block');
  });

  it('data: 스킴은 block한다', () => {
    expect(decideNavigation('data:text/html,<script>alert(1)</script>', ALLOWED_ORIGIN)).toBe('block');
  });

  it('intent: 스킴은 block한다', () => {
    expect(decideNavigation('intent://scan/#Intent;scheme=app;end', ALLOWED_ORIGIN)).toBe('block');
  });

  it('허용 origin이 https일 때 같은 host의 http는 다운그레이드로 block한다', () => {
    expect(decideNavigation('http://app.example.com/scan', ALLOWED_ORIGIN)).toBe('block');
  });

  it('파싱할 수 없는 URL은 block한다', () => {
    expect(decideNavigation('not a url', ALLOWED_ORIGIN)).toBe('block');
  });
});
