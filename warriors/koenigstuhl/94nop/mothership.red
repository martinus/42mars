;redcode-94b 
;name MotherShip
;author ZeFlox 
;strategy double silk -> rock 
;assert 1 
fstep equ 1000 
sstep equ 125 
start spl 1, 0 
	spl 1, 0 
	mov -1, 0 
fsilk spl @fsilk, #fstep 
	mov }fsilk, >fsilk 
ssilk spl @ssilk, #sstep 
	mov }ssilk, >ssilk 
rock spl rock, >rock-1 
	mov 1, >rock-1 
	dat <rock-2, #2-rock 
end 

