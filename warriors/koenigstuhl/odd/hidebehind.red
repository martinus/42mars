;redcode-94odd
;name Hide Behind!
;author John Metcalf
;strategy correctly placed decoy!
;assert 1

for 13
dat 1,1
rof

for 2
dat 0,0
rof

     step equ 7
loop:mov imp,  @ptr
ptr: mov imp,  -400

     add #-step*2, ptr
     jmp loop
imp:mov.i #-step, 1

end loop

