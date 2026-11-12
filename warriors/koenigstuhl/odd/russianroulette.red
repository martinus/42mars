;redcode-94odd
;name Russian Roulette
;author Lukasz Adamowski
;strategy ...born 13th July 128
;assert 1

djnclr  djn.f   #0      , <-1

day     equ     13
month   equ     7
year    equ     128
magic   equ     44

start   ldp.a   #magic, $6
        mul.a   #day,   $5
        add.a   #month, $4
        mod.a   #year,  $3
        stp.ab  $2,     #magic
        mod.a   #3,     $1
        jmp     @0,     $djnclr
        dat     $0,     $imp
        dat     $0,     $gate

imp     mov.i   #1      , $1
        dat     0       , 0
gate    jmp     $0      , <-20

        end     start
