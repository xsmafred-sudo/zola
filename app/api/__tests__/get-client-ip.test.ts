import { getClientIP } from '@/lib/api';

describe('getClientIP', () => {
  it('should extract IP from x-forwarded-for header', () => {
    const request = new Request('http://example.com', {
      headers: {
        'x-forwarded-for': '192.168.1.1, 10.0.0.1'
      }
    });

    const ip = getClientIP(request);
    expect(ip).toBe('192.168.1.1'); // Should return first IP
  });

  it('should extract IP from x-real-ip header', () => {
    const request = new Request('http://example.com', {
      headers: {
        'x-real-ip': '192.168.1.100'
      }
    });

    const ip = getClientIP(request);
    expect(ip).toBe('192.168.1.100');
  });

  it('should extract IP from cf-connecting-ip header', () => {
    const request = new Request('http://example.com', {
      headers: {
        'cf-connecting-ip': '203.0.113.1'
      }
    });

    const ip = getClientIP(request);
    expect(ip).toBe('203.0.113.1');
  });

  it('should prioritize x-forwarded-for over other headers', () => {
    const request = new Request('http://example.com', {
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'x-real-ip': '192.168.1.100',
        'cf-connecting-ip': '203.0.113.1'
      }
    });

    const ip = getClientIP(request);
    expect(ip).toBe('192.168.1.1');
  });

  it('should return null when no IP headers are present', () => {
    const request = new Request('http://example.com', {
      headers: {
        'content-type': 'application/json'
      }
    });

    const ip = getClientIP(request);
    expect(ip).toBeNull();
  });

  it('should handle empty x-forwarded-for header', () => {
    const request = new Request('http://example.com', {
      headers: {
        'x-forwarded-for': ''
      }
    });

    const ip = getClientIP(request);
    expect(ip).toBeNull();
  });

  it('should handle whitespace in x-forwarded-for', () => {
    const request = new Request('http://example.com', {
      headers: {
        'x-forwarded-for': '  192.168.1.1  ,  10.0.0.1  '
      }
    });

    const ip = getClientIP(request);
    expect(ip).toBe('192.168.1.1');
  });
});
