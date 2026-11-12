;redcode-icws
;name Twimp
;author Monika Keindl
;assert CORESIZE==8192

d       equ 8193/3
ds      equ 8193/6

offset  dat #3438 ,#-3438
twill   spl 0
        sub offset,1
        mov <0,0
        jmp -2,0

        dat #0
        dat #0

start   mov imp,imp+ds
        spl 1
        spl 16
        spl 8
        spl 4
        spl 2
        jmp imp
        jmp imp+(d)
        spl 2
        jmp imp+(d+d)
        jmp imp+(d+d+d)
        spl 4
        spl 2
        jmp imp+(d+d+d+d)
        jmp imp+(d+d+d+d+d)
        spl 2
        jmp imp    +ds
        jmp imp+(d)+ds

        spl 8
        spl 4
        spl 2
        jmp imp+(d+d)+ds
        jmp imp+(d+d+d)+ds
        spl 2
        jmp imp+(d+d+d+d)+ds
        jmp imp+(d+d+d+d+d)+ds
        spl twill
        spl twill
        spl twill
        spl twill
        spl twill
        dat #0

imp     mov 0,d
        end start

