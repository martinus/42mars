;redcode-cc
;name Squished Scanner
;author John Metcalf
;strategy RF16 blur scan
;strategy 76 characters, approx 129 Wilfiz
;assert 1

l mov   5,   >-1
s seq   875, 870
o mov   s,   -3
  add   2,   s
  jmn   l,   s
  spl   #870,870
  mov   2,   >s
  djn.f -1,  >s
  dat   9
  end   o
