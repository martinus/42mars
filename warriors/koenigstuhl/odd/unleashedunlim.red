;redcode-DS
;name Unleashed Unlimited
;author Roy van Rijn
;assert 1
;kill Y1

wGo mov hBomb , wGo+sAway+6+hOff
spl }2 , }2861
spl 1 , }1748
spl 0 , }2907

mov <dGo , {dBoo
dBoo spl wGo+sAway+6 , }177

pGo spl.b @0 , >4142;2064
mov.i }-1 , >-1
mov.i 1 , }6192;86
mov.i <488 , >-3
mov.i {-4 , {1
djn.f 987 , <267;473

dat 0 , 0

sAway equ 1803

hStep equ 17
hTime equ 7485
hDjn equ 6973
hOff equ 289

dGo spl #0 , 6
mov hBomb+hOff , @hPtr
hHit add #hStep*2 , hPtr
hPtr mov hBomb+hOff , }hHit-hStep*hTime
djn.f -3 , {hDjn

dat 0 , 0
hBomb dat }hStep , >1

end wGo

