;redcode-94
;assert CORESIZE==8000
;name My Mini Challenge #3
;author David Moore
;strategy extra imp stomper to guarantee 100% wins

org start

top dat 0,0
dat 0,0
dat 0,0
dat 0,0
check1 dat 0,0
dat 0,0
dat 0,0
scan1 jmz 0, check1
djn 0, #2
mov.i #0, <1
jmp 0, check1 - 5334 + 1

start jmn scan1, top ;decide which imp stomper to use
jmp start, 0
jmp scan2, 0 ;if overrun by imp then go to spare stomper

dat 0,0
dat 0,0
dat 0,0
check2 dat 0,0
dat 0,0
dat 0,0

scan2 jmz 0, check2
djn 0, #2
mov.i #0, <1
jmp 0, check2 - 5334 + 1

end

;	***** SCORE 100% WINS *****

