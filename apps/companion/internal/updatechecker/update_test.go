package updatechecker

import "testing"

func TestCompare(t *testing.T) {
	cases := []struct {
		a, b string
		want int
	}{
		{"1.0.0", "0.9.0", 1}, {"v1.0.0", "1.0.0", 0}, {"1.0.1", "1.0.2", -1}, {"2.0.0", "1.99.99", 1},
	}
	for _, tc := range cases {
		if got := Compare(tc.a, tc.b); got != tc.want {
			t.Fatalf("Compare(%q,%q)=%d want %d", tc.a, tc.b, got, tc.want)
		}
	}
}
