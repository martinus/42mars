;redcode-rf22
;name qu bomba
;author Sascha Zapf
;strategy Quickbomber and twinstone
;assert 1

bstart equ start+50+25

start spl pGo
 spl block2
 spl block3
 
block1 spl 1
 mov bomb,*bstart+25
 mov bomb,*bstart+50
 mov bomb,*bstart+75
 mov bomb,*bstart+100
 mov bomb,*bstart+125

 dat 0,0
 
block2 spl 1
 mov bomb,*bstart+150
 mov bomb,*bstart+175
 mov bomb,*bstart+200
 mov bomb,*bstart+225
 mov bomb,*bstart+250

 dat 0,0
 
block3 spl 1
 mov bomb,*bstart+275
 mov bomb,*bstart+300
 mov bomb,*bstart+325
 mov bomb,*bstart+350
 mov bomb,*bstart+375

bomb dat <375,<267

 for 15
 dat 0,0
 rof

sStep equ 222;357
pAwa equ 141;686

pGo         mov.i   Stone,     pGo+pAwa
            mov.i   Stone+1,   pGo+pAwa+1
            mov.i   Stone+2,   pGo+pAwa+2
            spl     pGo+pAwa

Stone      mov     {328,1-sStep
           sub.x   #sStep   ,-1
           jmp     -2       ,}-2





end start