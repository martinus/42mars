;redcode-94
;name Seeker
;author 42mars sample
;strategy Scanner: compares two cells 4000 apart, stepping by 12. Where the
;strategy core is not empty it bombs both cells, then keeps looking. After a
;strategy full lap it clears the core, stopping short of itself.
;assert CORESIZE == 8000
step    equ     12
laps    equ     (CORESIZE/2/step - 4)

        org     scan
inc     dat     #step,  #step
scan    add.f   inc,    ptr
ptr     seq.i   bomb+step, bomb+step+4000
        jmp     found
        djn.b   scan,   #laps
        jmp     clear
found   mov.i   bomb,   *ptr
        mov.i   bomb,   @ptr
        jmp     scan
clear   mov.i   bomb,   >gate
        djn.b   clear,  #CORESIZE-16
        jmp     0
gate    dat     #0,     #2
bomb    dat     #0,     #0
        end
