;redcode-DS
;name Unleashed 2
;author Roy van Rijn
;strategy Hidden for now...
;kill Unleashed
;assert 1

wGo mov sBomb , sAway+wGo+6+sOff
spl }2 , {3473
spl 2 , {4238
spl 0 , {3525
mov <sGo , {sBoo
mov imp2 , <iStart
mov imp1 , <iPtr2
sBoo djn wGo+sAway+6 , #5

iStep equ 2667
hStep equ ((iStep+1)/2)

iStart spl 1 , imp2+5
iPtr2 spl #hStep , imp2+5+hStep
add.f -1 , 1
djn.f imp2-hStep*2 , {730

sAway equ 4655
sStep equ 3039
sTime equ 3360
sDjn equ 6807
sOff equ 5

sGo spl #0 , 5
sLoop mov sPtr+2+sOff , @sPtr
sHit add #sStep*2 , sPtr
sPtr mov sPtr+2+sOff , }sHit-sStep*sTime
djn.f sLoop , <sDjn

imp2 mov.i #iStep , *0
imp1 mov.i #0 , iStep

sBomb dat }sStep , >1


end wGo


