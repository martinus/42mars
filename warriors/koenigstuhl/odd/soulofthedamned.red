;redcode-94nop
;name Soul of the Damned
;author Simon Wainwright
;strategy stolen vamp/stone idea
;strategy added imps
;assert 1

        step         equ            1976

stone   spl       #-step,          <step
loop    mov         bomb,          *fang
hit     mov         fang,          @fang
        add        stone,           @hit
        djn.f       loop,         <-1000
        dat            0,              0

fang    jmp     hit-step,  -hit+pit+step

        dat            0,              0
        dat            0,              0
bomb    dat    }fang-hit,             >1
        dat            0,              0

pit     spl           #0,         {count
        spl          pit
count   jmn           -1,  #MAXPROCESSES
        dat            0,              0

        impboot      equ        imp+7379
        impstep      equ            1143

start   spl        stone,          <7200
        mov          imp,        impboot
        spl            1,          <7300
        spl            1,          <7400
        spl            1,          <7500
        spl            1,          <7600
        spl       impadd,          <7700
impjmp  jmp      impboot,         }-2000
imp     mov.i         #1,        impstep
impadd  add.f   #impstep,         impjmp
        end        start
