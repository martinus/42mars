;redcode-tiny
;name Dimachaerus 3
;author inversed
;strategy Quickbomb -> Bishot with SPL/DIV clear
;date 2022.05.11
;assert CORESIZE == 800

step    equ     404
hop     equ     490
s0      equ     430
djs     equ     372
ka      equ     677
kb      equ     103

q0a     equ     527
qda     equ     778
q0b     equ     584
qdb     equ     411
qalpha  equ     q0a + (i - 1) * qda
qbeta   equ     q0b + (i - 1) * qdb
qspace  equ     1
qlen    equ     (11 - qspace)

org     go - qlen

scan    add       inc   ,     ptr 
ptr     sne.b     s0    ,     s0 + hop
        djn.f     scan  ,   < djs   
        
        div.x   # ka    ,   # kb
inc     spl     # step  ,     step
cloop   mov       inc   ,   } ptr
        mov       inc   ,   > ptr
        djn.a     cloop ,   < inc

    for qspace
        dat       0     ,     0
    rof
    i for qlen
        mov     { qalpha,     qbeta
    rof
go      djn.f     ptr   ,   { q0a + qlen * qda

