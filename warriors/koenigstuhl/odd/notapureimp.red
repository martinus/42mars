;redcode-94x
;name Not a pure imp at least!
;author John Metcalf
;strategy imp bomber
;assert 1

     step equ 7
loop:mov imp,  @ptr
ptr: mov imp,  -400

     add #-step*2, ptr
     jmp loop
imp:mov.i #-step, 1
     end

