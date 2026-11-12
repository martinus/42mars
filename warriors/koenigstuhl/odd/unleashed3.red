;redcode-DS
;name Unleashed 3
;author Roy van Rijn
;strategy Hidden for now...
;kill Unleashed 2
;assert 1

wGo mov hBomb , wGo+sAway+6+hOff
spl }2 , }1080
spl 1 , }7025
spl 0 , }4105

mov <dGo , {dBoo
dBoo spl wGo+sAway+6 , }7679

pGo spl.b @0 , >1935
mov.i }-1 , >-1
mov.i 1 , }5727
mov.i <2164 , >-3
mov.i {-4 , {1
djn.f 816 , <2139

sAway equ 4317

hStep equ 17
hTime equ 7485
hDjn equ 6554
hOff equ 334

dGo spl #0 , 6
mov hBomb+hOff , @hPtr
hHit add #hStep*2 , hPtr
hPtr mov hBomb+hOff , }hHit-hStep*hTime
djn.f -3 , {hDjn

dat 0 , 0
hBomb dat }hStep , >1

end wGo