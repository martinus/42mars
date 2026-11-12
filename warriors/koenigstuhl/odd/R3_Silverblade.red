;redcode
;name Silverblade
;author inversed
;strategy Blur scan with zooom trick
;strategy Corewar Global Masters 2022 round 3 entry
;assert (CORESIZE==8000)

safe    equ     8
org     setup

zooom   nop     }adj1,      {adj2
bptr    mov.b   @adj2,      #0
        mov     inc,        >bptr
scan    add     inc,        @adj2
ptr     seq     }6,         -2
adj1    jmn     zooom,      ptr
adj2    jmn     scan,       ptr
inc     spl     #-8,        -8
dclear  mov     kill,       >ptr
        djn.f   dclear,     >ptr
        dat     0,          0
kill    dat     1,          safe

setup   add     inc,        @dclear+1
        add     inc,         inc
        nop     {inc,       <inc
        div.a   #8,         bp
        mul.a   #-1,        bp

copy    mov     {kill,      {bp
        mov     {kill,      {bp
        djn     copy,       #6
bp      jmp     @-8,        0
