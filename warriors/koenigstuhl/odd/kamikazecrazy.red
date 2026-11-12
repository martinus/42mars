;Redcode-b
;show source
;show on
;name Kamikaze Crazy
;author Jeremy Chin
;strategy Lay imps and SPLs all over the place
;assert 1
; KOFACOTO-1

;show off

start:
mov bomb,-1
cmp 3,#7996
add #12,2
add #4,1
mov imp,4

cmp 3,#7980
add #12,2
add #4,1
mov slow,4

add #12,1
mov bomb, 12
jmp start

bomb: div 0,0
imp: mov 0,1
slow: spl 0
end start
