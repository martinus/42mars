;redcode-lp
;author inversed
;name Eyeglass
;strategy Typical scanner with some enchancements
;assert (CORESIZE==8000) && (MAXPROCESSES==8)

ofs     equ     bptr
len     equ     7
step    equ     831

gate    equ     ptr-1
org     loop

ptr     dat       0         ,     ofs
        dat       0         ,     0
loop    add     # step+1    ,     ptr
        jmz.f     loop      ,   < ptr
        slt       ptr       ,   # len
        mov     * bptr      ,   @ ptr
        jmp       loop      ,   < gate

        jmp     # 1         ,     1
bptr    jmp      -1         ,    -1

