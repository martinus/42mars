;redcode-tiny
;name Runestone
;author S.Fernandes
;strategy dual stone
;assert CORESIZE==800
 
        org     boot
 
step    equ     -148
 
stone   spl     #-step      ,    {step
sloop   mov     >-step      ,    1+step
        add     stone       ,    sloop
        djn.f   sloop       ,    {-120
 
        for     10
        dat     0           ,    0
        rof
 
boot    mov     {src        ,    {twin
        mov     {src        ,    {twin
        mov     {src        ,    {twin
        mov     {src        ,    {twin
twin    spl     stone+404   ,    {100
src     djn.f   stone+4     ,    <101
