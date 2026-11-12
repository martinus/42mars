;redcode-odd
;name sp_test1
;author Lukasz Grabun
;assert CORESIZE==8000

soff    equ     (7426+orig)
orig z for 0
        rof

ploc1    equ    3390
phit1   equ     6930
phit2   equ     2395

pgo      spl   1 ,0
         spl   1 ,0
         spl   1 ,0
p1s      mov   p1b,>8
p1c      mov   <p1s,<p1n
p1n      spl   @0,>ploc1
         mov   p1b,<p1n
         mov   p1b,<phit1
         mov   p1b,>phit2
         jmn.f @0,>p1s
p1b      dat   <2667,<5334

for 70
dat 0,0
rof

step    equ    (107)              ;
first   equ    (-115-1)           ; first bomb is thrown here
hop     equ    (6916+1)           ; offset between bombs thrown in one
gate    equ    (hop+smov-1)       ; gate is formed here

stone   spl    #   0 , #0         ; based on skew dwarf
ptr     mov     bomb , {first     ; but without hitting the
smov    mov     bomb , @ptr       ; djn line.
        sub    #step ,  ptr
        djn.f   ptr , <5500
bomb    dat    <hop , >1

boot    spl     pgo
        mov     bomb  , soff
src     spl     2, bomb
off     spl     2, soff
        spl     1
        mov     <src  , <off
        jmp     @off

        end boot