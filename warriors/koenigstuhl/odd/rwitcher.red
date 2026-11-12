;redcode-94
;name Rwitcher
;author Will 'Varfar'
;strategy Roy van Rijn's Switcher :)
;assert 1 
; || (t=4954) || (a=1601) || (b=12) || (c=-188) || (d=10) 
; || (e=1194) || (f=3199) || (g=4354) || (h=7262) || (i=4229)

S equ spl
R equ S 1
M equ mov

z M 6,<3
M 4,<2
M 2,<1
jmp @0,t

m M    {a,1-t
sub.x  #t ,m
jmp    m,}m

r equ (z-3)

q ldp     }r,r
  ldp.ab  r,@r
  stp.a   @r,<r+1
  jmz.b   z,@r+1

R
R
R
M {b,{1
S c
M <d,{1
S e
n for 3
S @0,}f*n+g*(n-1)+h*(n-2)
M }-1,>-1
rof
M.i #1,<1
djn -2,<i

end q
