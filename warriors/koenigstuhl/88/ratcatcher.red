;redcode verbose
;name ratcatcher
;author M.Pellmann
;strategy convert all to  mov 0 1 and kill it with djn
;assert 1

target3  dat  #0
target2  dat  #4000
target1  dat  #1000
target   dat  #-200
start    spl  send0
         spl  send1
pre     mov  b1,<target
        djn  pre,<target
        spl  loop1
        spl  loop2
        spl  loop3
        spl  send
        mov  #20,target
loop    djn  loop,<target
        jmp  loop
        dat  #0
        dat  #0
b1      dat  #0
loop1 	djn  loop1,<target1
        mov  dat1,target1
        jmp  loop1
        dat  #0
dat1    dat  #0
        dat  #0
loop2   djn  loop2,<target2
        mov  #0,target2
        jmp  loop2
        dat  #0
        dat  #0
        dat  #0
loop3   mov  datx,<target3
        djn  loop3,<target3
        add  #10,target3
        jmp  loop3
        dat  #0
        dat  #0
send    mov  knirps,20
        mov  #1,19
        mov  #1,19
        jmp  17
datx    dat  #-5
knirps  mov 0,1
        dat #0
send0   mov  knirps,70
        jmp  69
send1   mov  knirps,4000
        jmp  3999
        end  start

