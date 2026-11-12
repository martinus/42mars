;redcode-DS
;name Unleashed
;author Roy van Rijn
;strategy Hidden for now...
;assert 1
;kill Unleashed

sAway equ 4317

wGo mov hBomb , wGo+sAway+6+hOff
spl }2 , }1080
spl 1 , }7025
spl 0 , }4105

mov <dGo , {dBoo
dBoo spl wGo+sAway+6 , }7679
spl *-1 , }3531

pStep1 equ 5575
bStep1 equ 275

pGo spl pStep1 , {3
mov }2 , }-1
mov pBmb , >bStep1
mov 3 , }-3
jmz.f -4 , *-1
pBmb dat <5334 , <2667

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


