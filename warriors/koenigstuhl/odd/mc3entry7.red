;redcode
;author Lukasz Adamowski
;strategy Wait till it comes...
;strategy And then let it kill itself!
;assert 1

check dat 0, 0
dat 0, 0
pit mov bomb, 2667-2
mov bomb, 2*2667-2
mov bomb, 3*2667-2
mov bomb, 4*2667-2
mov bomb, 5*2667-2
mov bomb, 6*2667-2
mov bomb, 7*2667-2
bomb dat <2667, <-2667
start jmz.f #0, check
nop 0, 0
mov.i 2, check-1
jmp 0
jmp pit-check+1

end start
 
