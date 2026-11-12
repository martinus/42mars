;redcode-94 quiet
;name Backwards
;author Zul Nadzri
;assert 1
;strategy use larger numbers for step size such as 777 for bigger spread

step equ 3

spl 1,0
spl @0, >-step
mov }-1, >-1

