;redcode-icws
;name Halfway Home IRC11
;author Philip Thorne
;assert 1

ISIZ    EQU 3277
STEP    EQU 2895
B_PUMP  EQU (pump+2557+1)

vamp:   spl     0
        mov     fang,       @fang
        add     incr,       fang
        jmp     -2


pump:   spl     2
        jmp     @0,     pump+100
        add     #ISIZ,  -1


boot:   spl     vamp

booti:  mov     pump,       B_PUMP
        mov     pump+1,     B_PUMP+1
        mov     pump+2,     B_PUMP+2
        mov     imp,        B_PUMP+100

prime:  spl     1
        mov     -1,         0
        mov     -1,         0
        spl     1
        jmp     B_PUMP

imp:    mov     0,          ISIZ

fang:   jmp     -STEP+pit,  STEP
incr:   dat     #-STEP,     #STEP

pit:    spl     1,          0
        spl     1,          0
        spl     1,          0
        spl     1,          0
        mov     0,          -1

    end boot
