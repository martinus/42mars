;redcode
;name entry two
;author Sascha Zapf
;strategy
;assert 1
; CORESIZE==2520

start    spl    >0,    <0
    mov.i    >datbptr,    <datb+1
    mov.i    <datbptr,    <datb+1
datbptr dat.f    <datb,<datb
datb    dat.f    <-10,<-10
    dat.f    <-10,<-10
    
    end start
    

