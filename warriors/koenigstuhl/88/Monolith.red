;redcode
;name Monolith
;author inversed
;strategy Scanner with fixed length attack
;assert (CORESIZE==8000) && (MAXPROCESSES==8000)

;.............. Scanner ...................................;

step    equ    -9*16
hop     equ     8
sofs    equ     step
wlen    equ     15
wptr    equ     ptr+hop+overlap
gate1   equ     attack
gate2   equ     attack+1
overlap equ     3
stream  equ     4000
ikill   equ     2667

attack  mov     # wlen      ,     cnt
        mov       ptr       ,     wptr
wipe    mov       bomb      ,   < wptr
cnt     djn       wipe      ,   # wlen
loop    add       inc       ,     ptr
ptr     cmp       sofs+hop  ,     sofs
        jmn       attack    ,   @ loop
        jmn       loop      ,   @ loop
bomb    spl       0         ,   < gate2
clear   mov       kill      ,   < gate1
        djn       clear     ,   < stream
kill    dat     < ikill     ,   < gate2-bomb-1
inc     add       step      ,     step

;.............. Boot ......................................;

x0      equ     attack
bd      equ     6881
len     equ     13
        
        dat     # 0         ,   # 0
        jmn      -6         ,   @-2         ; Mirror
for len
        mov     < inc+1     ,   < bp
rof
bp      jmp       x0+bd+5   ,     x0+bd+len

;.............. Decoy .....................................;

        dat     # 0         ,   # 0
        mov     <-9         ,   < 6         ; Mirror
j for   8
i for   7
        spl       1-i       ,     8*j+i
rof
        spl      -7         ,     8
rof

;..........................................................;

end     bp-len

