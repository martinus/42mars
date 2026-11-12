;redcode
;name ImpLauncher
;author usenetposter@mac.com
;assert 1

imp_step equ 2667
half_step equ ((imp_step+1)/2)

start   mov imp2, imp1+0+half_step
        mov imp2, imp1+1+half_step
        mov imp2, imp1+2+half_step
        spl 1,0

        spl #0, 0
        add.f #half_step, 1
        jmp imp1-half_step*2, >500

imp1    mov.i #imp_step, *0
        mov.i #imp_step, *0
        mov.i #imp_step, *0
imp2    mov.i #0, imp_step

end 

